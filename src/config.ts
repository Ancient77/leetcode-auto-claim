const config = { urls : {
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
    favorite_delete: 'https://leetcode.com/list/api/questions/$hash/$id'
}
}

export default config;