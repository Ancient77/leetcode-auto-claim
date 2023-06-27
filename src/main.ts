import request from "request"
import _ from "underscore"
import fs from "fs"
require('dotenv').config()
import config from "./config"
import { User, Problem, Submission } from "./types";
import { retryPromise } from "./helper"
import { Color, ConsoleTable } from "./console"
let consoleTable = new ConsoleTable();


//Sometimes this just wont work, need to add a retry
async function linkedinLogin(login: string, pass: string): Promise<User> {
    const leetcodeUrl = config.urls.linkedin_login;
    const _request = request.defaults({
        jar: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36'
        }
    });
    return new Promise((resolve, reject) => {
        _request(config.urls.linkedin_login_request, function (e, resp, body) {
            if (resp.statusCode !== 200) {
                throw new Error('Get LinkedIn session failed');
            }
            const csrfToken = body.match(/input type="hidden" name="csrfToken" value="(.*?)"/);
            const loginCsrfToken = body.match(/input type="hidden" name="loginCsrfParam" value="(.*?)"/);
            const sIdString = body.match(/input type="hidden" name="sIdString" value="(.*?)"/);
            const pageInstance = body.match(/input type="hidden" name="pageInstance" value="(.*?)"/);
            if (!(csrfToken && loginCsrfToken && sIdString && pageInstance)) {
                throw new Error('Get LinkedIn payload failed');
            }
            const options = {
                url: config.urls.linkedin_session_request,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                followAllRedirects: true,
                form: {
                    'csrfToken': csrfToken[1],
                    'session_key': login,
                    'ac': 2,
                    'sIdString': sIdString[1],
                    'parentPageKey': 'd_checkpoint_lg_consumerLogin',
                    'pageInstance': pageInstance[1],
                    'trk': 'public_profile_nav-header-signin',
                    'authUUID': '',
                    'session_redirect': 'https://www.linkedin.com/feed/',
                    'loginCsrfParam': loginCsrfToken[1],
                    'fp_data': 'default',
                    '_d': 'd',
                    'showGoogleOneTapLogin': true,
                    'controlId': 'd_checkpoint_lg_consumerLogin-login_submit_button',
                    'session_password': pass,
                    'loginFlow': 'REMEMBER_ME_OPTIN'
                },
            };
            _request(options, async function (e, resp, body) {
                if (resp.statusCode !== 200) {
                    throw new Error('LinkedIn login failed');
                }
                resolve(await leetcodeLogin(_request, leetcodeUrl));
            });
        });

    })
};

async function leetcodeLogin(request: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>, leetcodeUrl: string): Promise<User> {
    return new Promise((resolve, reject) => {
        request.get({ url: leetcodeUrl }, function (e, resp, body) {
            const redirectUri = resp.request.uri.href;
            if (redirectUri !== config.urls.leetcode_redirect) {
                throw new Error('Login failed ');
            }
            resolve(parseCookie(resp.request.headers.cookie));
        });
    })
}
function parseCookie(cookie: string): { sessionId: string, sessionCSRF: string } {
    const SessionPattern = /LEETCODE_SESSION=(.+?)(;|$)/;
    const csrfPattern = /csrftoken=(.+?)(;|$)/;
    const reCsrfResult = csrfPattern.exec(cookie);
    const reSessionResult = SessionPattern.exec(cookie);
    if (reSessionResult === null || reCsrfResult === null) {
        throw new Error('invalid cookie?');
    }
    return {
        sessionId: reSessionResult![1],
        sessionCSRF: reCsrfResult![1],
    };
}

function signOpts(opts: request.CoreOptions & request.UrlOptions, user: { sessionId: string; sessionCSRF: string; }): void {
    opts.headers!.Cookie = 'LEETCODE_SESSION=' + user.sessionId +
        ';csrftoken=' + user.sessionCSRF + ';';
    opts.headers!['X-CSRFToken'] = user.sessionCSRF;
    opts.headers!['X-Requested-With'] = 'XMLHttpRequest';
};

function makeOpts(url: string, user?: User): request.CoreOptions & request.UrlOptions {
    const opts: request.CoreOptions & request.UrlOptions = {
        url: url,
        headers: {},
    };
    if (user) {
        signOpts(opts, user);
    }
    return opts;
};
async function submitProblem(submission: Submission, problem: Problem, user: User): Promise<{ submission_id: number }> {
    consoleTable.updateStatus(Color.yellow, 'running leetcode.submitProblem');
    const opts = makeOpts(config.urls.submit.replace('$slug', problem.titleSlug), user);
    opts.body = {
        lang: submission.lang,
        question_id: parseInt(problem.questionId, 10),
        test_mode: false,
        typed_code: submission.code,
        judge_type: 'large',
    };
    opts.method = 'POST';
    opts.headers!.Origin = config.urls.base;
    opts.headers!.Referer = config.urls.problem.replace('$slug', problem.titleSlug);
    opts.json = true;

    try {
        const body = await new Promise<{ submission_id: number, error?: string }>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    consoleTable.updateError(Color.red, error.message)
                    reject(error);
                } else {
                    resolve(body);
                }
            });
        });

        if (body.error) {
            if (!body.error.includes('too soon')) {
                throw new Error(body.error);
            }

            // hit 'run code too soon' error, have to wait a bit
            // linear wait
            consoleTable.updateStatus(Color.yellow, 'hit \'run code too soon\' error, have to wait a bit');
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return submitProblem(submission, problem, user);
        }

        return body;
    } catch (error) {
        throw error;
    }
}

/**
 * Retrieves the latest submission for a given problem and user.
 * @param problem The problem to retrieve the submission for.
 * @param user The user to retrieve the submission for.
 * @returns The latest submission for the given problem and user.
 * @throws An error if no submissions are found.
 */
async function getLatestSubmission(problem: Problem, user: User): Promise<Submission> {
    consoleTable.updateStatus(Color.yellow, `Retrieving latest submission for problem ${problem.titleSlug}`);

    const opts = makeOpts(config.urls.submissions.replace('$slug', problem.titleSlug), user);
    opts.headers!.Referer = config.urls.problem.replace('$slug', problem.titleSlug);


    const body = await new Promise<string>((resolve, reject) => {
        request(opts, (error, response, body) => {
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        });
    });

    const submissions = JSON.parse(body).submissions_dump;
    if (submissions.length === 0) {
        throw new Error('No submissions found');
    }

    for (const submission of submissions) {
        submission.id = _.last(_.compact(submission.url.split('/')));
    }

    return submissions[0]; // latest submission
};

// Daily challenge for leetcode.com
async function getProblemOfToday(): Promise<Problem> {
    consoleTable.updateStatus(Color.yellow, 'getting Problem Of the Day');
    const opts = makeOpts(config.urls.graphql);
    opts.headers!.Origin = config.urls.base;
    opts.headers!.Referer = config.urls.base;

    opts.json = true;
    opts.body = {
        query: `query {
            activeDailyCodingChallengeQuestion {
                date
                link
                question {
                    questionId
                    questionFrontendId
                    boundTopicId
                    title
                    titleSlug
                    content
                    translatedTitle
                    translatedContent
                    isPaidOnly
                    difficulty
                    likes
                    dislikes
                    isLiked
                    similarQuestions
                    exampleTestcases
                    contributors {
                        username
                        profileUrl
                        avatarUrl
                    }
                    topicTags {
                        name
                        slug
                        translatedName
                    }
                    companyTagStats
                    codeSnippets {
                        lang
                        langSlug
                        code
                    }
                    stats
                    hints
                    solution {
                        id
                        canSeeDetail
                        paidOnly
                        hasVideoSolution
                        paidOnlyVideo
                    }
                    status
                    sampleTestCase
                    metaData
                    judgerAvailable
                    judgeType
                    mysqlSchemas
                    enableRunCode
                    enableTestMode
                    enableDebugger
                    envInfo
                    libraryUrl
                    adminUrl
                    challengeQuestion {
                        id
                        date
                        incompleteChallengeCount
                        streakCount
                        type
                    }
                    note
                }
            }
}
        `,
        variables: {},
    };


    try {
        const DailyQuestion = await new Promise<Problem>((resolve, reject) => {
            request.post(opts, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(body.data.activeDailyCodingChallengeQuestion.question);
                }
            });
        });


        //console.log('Daily problem:', DailyQuestion.titleSlug);
        return DailyQuestion;
    } catch (error) {
        throw error;
    }
}

async function getTotalPoints(user: User): Promise<number> {
    const opts = makeOpts(config.urls.PointsTotal, user);
    try {
        const body = await new Promise<any>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {

                    resolve(JSON.parse(body));
                }
            });
        });



        return body.points;
    } catch (error) {
        console.error('Error getting total Points', error);
        throw error;
    }

}

async function getPointHistory(user: User): Promise<{ score: number, despriction: string, date: string }[]> {
    const opts = makeOpts(config.urls.pointHistory, user);


    try {
        const body = await new Promise<any>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(JSON.parse(body));
                }
            });
        });

        return body.scores;
    } catch (error) {
        throw error;
    }
}
function getSavedUser(): User | null {
    try {
        return JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
    } catch (error) {
        console.log('No saved user found')
        return null
    }

}
function saveUser(user: User): void {
    fs.writeFileSync('./cookies.json', JSON.stringify(user));
}
function isLoginSaved(): boolean {
    if (process.env.LINKEDIN_USERNAME && process.env.LINKEDIN_PASSWORD) {
        return true;
    } else {
        return false
    }
}

async function DailyProblemCheckAndSubmit(user: User) {
    try {
        const problem = await getProblemOfToday();
        const submission = await getLatestSubmission(problem, user).catch((err: any) => {
            throw new Error(`No submission found for problem ${problem.titleSlug}`);
        });
        if (!submission) {
            return;
        }
        const result = await submitProblem(submission, problem, user);

    } catch (error: unknown) {
        consoleTable.updateError(Color.red, `Error: ${(error as Error).message}`);
    }
}




(async () => {
    let user: User;
    //does not check if user is valid
    if (getSavedUser() != null) {
        user = getSavedUser()!;
    } else {
        if (isLoginSaved()) {
            user = await retryPromise(() => linkedinLogin(process.env.LINKEDIN_USERNAME!, process.env.LINKEDIN_PASSWORD!), 5, 5000);
            saveUser(user);
        } else {
            throw new Error('Please Add your linkedin username and password to env variables')
        }
    }
    consoleTable.updatePoints(Color.green, await getTotalPoints(user));
    await DailyProblemCheckAndSubmit(user);
    consoleTable.updateStatus(Color.green, `Waiting for next day`);
    setInterval(async () => {
        consoleTable.updatePoints(Color.green, await getTotalPoints(user));
        await DailyProblemCheckAndSubmit(user);
        consoleTable.updateStatus(Color.green, `Waiting for next day`);
    }, 24 * 60 * 60 * 1000);
})();
