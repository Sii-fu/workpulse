import type { NextFunction, Request, Response } from 'express';
import { isStrictLocalHost } from '../utils/hostCheck';

/**
 * Guard for the routes that read files on this computer. They answer only while the server is bound
 * to 127.0.0.1 (no LAN access) and only to requests addressed to localhost:<port> or
 * 127.0.0.1:<port>, which stops a website from reaching them through DNS rebinding.
 */
export function activityGuard(bindHost: string, port: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (bindHost !== '127.0.0.1' || !isStrictLocalHost(req.headers.host, port)) {
      res.status(403).json({ error: 'Activity suggestions only work on this computer, in the normal local setup.' });
      return;
    }
    next();
  };
}
