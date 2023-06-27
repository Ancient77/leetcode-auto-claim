export async function retryPromise<T>(promiseFn: () => Promise<T>, retries: number, waitTime: number): Promise<T> {
    try {
        const result = await promiseFn();
        return result;
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }
        console.log(`Retrying ${promiseFn.name}...`)
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return retryPromise(promiseFn, retries - 1, waitTime);
    }
}

