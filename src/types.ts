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
    memory: string,
    code: string,
    compare_result: string,
    title_slug: string,
    has_notes: boolean
  }


type User= {
    sessionId: string,
    sessionCSRF: string
}

export type {Problem, Submission, User};