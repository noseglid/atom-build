'use babel';

export const isWin = process.platform === 'win32';
export const sleep = (duration) => isWin ? `ping 127.0.0.1 -n ${duration} > NUL` : `sleep ${duration}`;
export const cat = () => isWin ? 'type' : 'cat';
export const shellCmd = isWin ? 'cmd /C' : '/bin/sh -c';
export const waitTime = process.env.CI ? 2400 : 200;
