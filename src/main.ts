import request from "request"
import _ from "underscore"
import fs from "fs"
require('dotenv').config()
import config from "./config"
import { User, Problem, Submission } from "./types";



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
    console.log('running leetcode.submitProblem');
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
                    console.log(response);
                    console.log(error);
                    reject(error);
                } else {
                    resolve(body);
                }
            });
        });
        console.log(body);
        if (body.error) {
            if (!body.error.includes('too soon')) {
                throw new Error(body.error);
            }

            // hit 'run code too soon' error, have to wait a bit
            console.log(body.error);

            // linear wait
            console.log('Will retry after %d seconds...', 5);
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            return submitProblem(submission, problem, user);
        }

        return body;
    } catch (error) {
        console.error('Error submitting problem:', error);
        throw error;
    }
}

async function getSubmissions(problem: Problem, user: User): Promise<Submission> {
    console.log('running leetcode.getSubmissions for problem %s', problem.titleSlug);
    const opts = makeOpts(config.urls.submissions.replace('$slug', problem.titleSlug), user);
    opts.headers!.Referer = config.urls.problem.replace('$slug', problem.titleSlug);

    try {
        const body = await new Promise<string>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    console.log(response);
                    console.log(error)
                    reject(error);
                } else {
                    resolve(body);
                }
            });
        });

        const submissions = JSON.parse(body).submissions_dump;
        for (const submission of submissions) {
            submission.id = _.last(_.compact(submission.url.split('/')));
        }

        return submissions[0]; // is this the latest submission?
    } catch (error) {
        console.error('Error getting submissions:', error);
        throw error;
    }

};

// Daily challenge for leetcode.com
async function getProblemOfToday():Promise<Problem> {
    console.log('running leetcode.getProblemOfToday...');
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


        console.log('Daily problem:', DailyQuestion.titleSlug);
        return DailyQuestion;
    } catch (error) {
        console.error('Error getting daily problem:', error);
        throw error;
    }
}

async function getTotalPoints(user: User): Promise<number> {
    console.log('running leetcode.getTotalPoints...');
    const opts = makeOpts(config.urls.PointsTotal, user);


    try {
        const body = await new Promise<any>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    console.log(response);
                    console.log(error)
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
    console.log('running leetcode.getPointHistory...');
    const opts = makeOpts(config.urls.pointHistory, user);


    try {
        const body = await new Promise<any>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    console.log(response);
                    console.log(error)
                    reject(error);
                } else {
                    resolve(JSON.parse(body));
                }
            });
        });

        return body.scores;
    } catch (error) {
        console.error('Error getting pointHistory', error);
        throw error;
    }
}
function getSavedUser():User | null{
        try {
           return JSON.parse(fs.readFileSync('../cookies.json','utf-8'));
        } catch (error) {
            console.log('No saved user found')
            return null
        }
    
}
function saveUser(user:User):void{
    fs.writeFileSync('../cookies.json',JSON.stringify(user));
}
function isLoginSaved():boolean{
    if(process.env.LINKEDIN_USERNAME && process.env.LINKEDIN_PASSWORD ){
        return true;
    }else{
        return false
    }
}






setTimeout(async () => {
    // let problem = await getProblemOfToday();
    // let submission = await getSubmissions(problem);
    // if(submission === null) {return;}
    // console.log(await submitProblem(submission, problem));
    
    let user = await linkedinLogin(process.env.LINKEDIN_USERNAME!, process.env.LINKEDIN_PASSWORD!);
    console.log(await getTotalPoints(user));



}, 1000);