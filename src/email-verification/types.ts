import { gmail_v1 } from 'googleapis';

export interface EmailMessage {
  id: string;
  internalDate: string;
  payload?: gmail_v1.Schema$MessagePart;
}

export interface VerificationCodeConfig {
  searchAfterTimestamp: Date;
  maxWaitMinutes?: number;
}

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface EmailSearchQuery {
  from: string;
  subject: string;
  after: string;
}
