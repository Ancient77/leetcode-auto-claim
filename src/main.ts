//NEED TO IMPLEMENT 
//.env save
//github
//telegram bot
//logging
//get coins from the coins website
//make every function actually async
//dont make user a global variable


import request from "request"
import _ from "underscore"
require('dotenv').config()
type Problem = {

    questionId: string,
    questionFrontendId: string,
    boundTopicId: string,
    title: string,
    titleSlug: string,
    content: string,
    translatedTitle: string,
    translatedContent: string,
    isPaidOnly: boolean,
    difficulty: string,
    likes: number,
    dislikes: number,
    isLiked: null,
    similarQuestions: string,
    contributors: string[],
    topicTags: {}[],
    stats: string,
    hints: string[],
    solution: {
        id: string,
        canSeeDetail: boolean,
        paidOnly: boolean,
        hasVideoSolution: boolean,
        paidOnlyVideo: boolean,
    }
    status: string,
    sampleTestCase: string,
    metaData: string,


}
type Submission =  {
    id: string,
    lang: string,
    lang_name: string,
    time: string,
    timestamp: number,
    status: number,
    status_display: string,
    runtime: string,
    url: string,
    is_pending: string,
    title: string,
    memory: '2.1 MB',
    code: string,
    compare_result: string,
    title_slug: string,
    has_notes: boolean
  }


type User= {
    login:string,
    pass: string,
    sessionId: string,
    sessionCSRF: string
}

let urls = {
    // base urls
    base: 'https://leetcode.com',
    graphql: 'https://leetcode.com/graphql',
    login: 'https://leetcode.com/accounts/login/',
    // third part login base urls. TODO facebook google
    github_login: 'https://leetcode.com/accounts/github/login/?next=%2F',
    facebook_login: 'https://leetcode.com/accounts/facebook/login/?next=%2F',
    linkedin_login: 'https://leetcode.com/accounts/linkedin_oauth2/login/?next=%2F',
    // redirect urls
    leetcode_redirect: 'https://leetcode.com/',
    github_tf_redirect: 'https://github.com/sessions/two-factor',
    // simulate login urls
    github_login_request: 'https://github.com/login',
    github_session_request: 'https://github.com/session',
    github_tf_session_request: 'https://github.com/sessions/two-factor',
    linkedin_login_request: 'https://www.linkedin.com/login',
    linkedin_session_request: 'https://www.linkedin.com/checkpoint/lg/login-submit',
    // questions urls
    PointsTotal: 'https://leetcode.com/points/api/total/',
    pointHistory: 'https://leetcode.com/points/api/',
    problems: 'https://leetcode.com/api/problems/$category/',
    problem: 'https://leetcode.com/problems/$slug/description/',
    test: 'https://leetcode.com/problems/$slug/interpret_solution/',
    session: 'https://leetcode.com/session/',
    submit: 'https://leetcode.com/problems/$slug/submit/',
    submissions: 'https://leetcode.com/api/submissions/$slug',
    submission: 'https://leetcode.com/submissions/detail/$id/',
    verify: 'https://leetcode.com/submissions/detail/$id/check/',
    favorites: 'https://leetcode.com/list/api/questions',
    favorite_delete: 'https://leetcode.com/list/api/questions/$hash/$id',
    plugin: 'https://raw.githubusercontent.com/leetcode-tools/leetcode-cli/master/lib/plugins/$name.js'
}


//Sometimes this just wont work, need to add a retry
function linkedinLogin(user: { login: any; pass: any; }) {
    const leetcodeUrl = urls.linkedin_login;
    const _request = request.defaults({
        jar: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36'
        }
    });
    _request(urls.linkedin_login_request, function (e, resp, body) {
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
            url: urls.linkedin_session_request,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            followAllRedirects: true,
            form: {
                'csrfToken': csrfToken[1],
                'session_key': user.login,
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
                'session_password': user.pass,
                'loginFlow': 'REMEMBER_ME_OPTIN'
            },
        };
        _request(options, function (e, resp, body) {
            if (resp.statusCode !== 200) {
                throw new Error('LinkedIn login failed');
            }
            requestLeetcodeAndSave(_request, leetcodeUrl, user);
        });
    });
};





function requestLeetcodeAndSave(request: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>, leetcodeUrl: string, user: { login?: any; pass?: any; sessionId?: any; sessionCSRF?: any; }) {
    request.get({ url: leetcodeUrl }, function (e, resp, body) {
        const redirectUri = resp.request.uri.href;
        if (redirectUri !== urls.leetcode_redirect) {
            console.log(resp.request)
            throw new Error('Login failed ');
        }
        const cookieData = parseCookie(resp.request.headers.cookie);
        user.sessionId = cookieData!.sessionId;
        user.sessionCSRF = cookieData!.sessionCSRF;
    });
}
function parseCookie(cookie: string): { sessionId: string, sessionCSRF: string } | void {
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

// update options with user credentials
function signOpts(opts: request.CoreOptions & request.UrlOptions, user: { sessionId: string; sessionCSRF: string; }) {
    opts.headers!.Cookie = 'LEETCODE_SESSION=' + user.sessionId +
        ';csrftoken=' + user.sessionCSRF + ';';
    opts.headers!['X-CSRFToken'] = user.sessionCSRF;
    opts.headers!['X-Requested-With'] = 'XMLHttpRequest';
};

function makeOpts(url: string): request.CoreOptions & request.UrlOptions {
    const opts: request.CoreOptions & request.UrlOptions = {
        url: url,
        headers: {},
        //body: {},
    };
    //if (session.isLogin())
    signOpts(opts, user);
    return opts;
};
async function submitProblem(submission: Submission, problem: Problem): Promise<{submission_id:number}> {
    console.log('running leetcode.submitProblem');
    const opts = makeOpts(urls.submit.replace('$slug', problem.titleSlug));
    opts.body = {
        lang: submission.lang,
        question_id: parseInt(problem.questionId, 10),
        test_mode: false,
        typed_code: submission.code,
        judge_type: 'large',
    };
    opts.method = 'POST';
    opts.headers!.Origin = urls.base;
    opts.headers!.Referer = urls.problem.replace('$slug', problem.titleSlug);
    opts.json = true;

    try {
        const body = await new Promise<{submission_id:number,error?:string}>((resolve, reject) => {
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
            return submitProblem(submission, problem);
        }

        return body;
    } catch (error) {
        console.error('Error submitting problem:', error);
        throw error;
    }
}

async function getSubmissions(problem: Problem): Promise<Submission|null> {
    console.log('running leetcode.getSubmissions for problem %s', problem.titleSlug);
    const opts = makeOpts(urls.submissions.replace('$slug', problem.titleSlug));
    opts.headers!.Referer = urls.problem.replace('$slug', problem.titleSlug);
    
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
async function getProblemOfToday() {
    console.log('running leetcode.getProblemOfToday...');
    const opts = makeOpts(urls.graphql);
    opts.headers!.Origin = urls.base;
    opts.headers!.Referer = urls.base;

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
        //query: 'query questionOfToday { currentDailyCodingChallenge { questionOfToday { question { titleSlug } } } }',
        variables: {},
        //operationName: 'questionOfToday'
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

async function getTotalPoints(user:User):Promise<number> {
    console.log('running leetcode.getTotalPoints...');
    const opts = makeOpts(urls.PointsTotal);
    
    
    try {
        const body = await new Promise<any>((resolve, reject) => {
            request(opts, (error, response, body) => {
                if (error) {
                    console.log(response);
                    console.log(error)
                    reject(error);
                } else {
                    console.log(body);
                    resolve(body);
                }
            });
        });
        
        

        return body.points; 
    } catch (error) {
        console.error('Error getting total Points', error);
        throw error;
    }

}

async function getPointHistory(user:User):Promise<{score:number,despriction:string, date:string}[]>{
    console.log('running leetcode.getPointHistory...');
    const opts = makeOpts(urls.pointHistory);
    
    
    try {
        const body = await new Promise<any>((resolve, reject) => {
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
        
        console.log(body)
        console.log(JSON.parse(body).scores)
        return body.scores; 
    } catch (error) {
        console.error('Error getting pointHisory', error);
        throw error;
    }
}



let user:User = {
    login: process.env.LINKEDIN_USERNAME!,
    pass: process.env.LINKEDIN_PASSWORD!,
    sessionId: "",
    sessionCSRF: ""
}


linkedinLogin(user);

setTimeout(async () => {
    // let problem = await getProblemOfToday();
    // let submission = await getSubmissions(problem);
    // if(submission === null) {return;}
    // console.log(await submitProblem(submission, problem));
    console.log(user)
   console.log(((await getPointHistory(user)).reduce((a,b)=>a+b.score,0)));
   

    
}, 10000);