import {handle, type Env} from '../../_lib/voting';
export const onRequest = ({request, env}: {request: Request; env: Env}) => handle(request, env);
