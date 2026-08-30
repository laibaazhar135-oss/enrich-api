export function exponentialbackoffwithjitter(attemptNumber){
    const baseDelay= Math.pow(2,attemptNumber)*1000;
    const jitter= Math.random()*500;
    return baseDelay+jitter;
}

export function isRetryableError(error){
    if(error.code==='ETIMEDOUT' || error.message.includes('TIMEOUT')){
        return {
            retryable: true,
            statusCode: 504
        }
    }
    const errorStatus= error.status;

    if(!errorStatus){
        return {retryable:true}
    }
    if(errorStatus===429){
        return{
            retryable:true,
            statusCode:errorStatus
        }
    }

    if(errorStatus>=500){
        return { retryable:true,
            statusCode:errorStatus
        }
    }
    if([400,401,403].includes(errorStatus)){
        return {
            retryable:false,
            statusCode:errorStatus
        }
    }
    if(errorStatus>=400){
        return{
            retryable:false,
            statusCode:errorStatus
        }
    }
    return {retryable:true};
}

export function sleep(ms){
      return new Promise((resolve)=>setTimeout(resolve,ms));
}