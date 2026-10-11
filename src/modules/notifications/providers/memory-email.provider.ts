import type { EmailInput, EmailProvider } from '../notification.types';

export class MemoryEmailProvider implements EmailProvider {
  public sentEmails: EmailInput[] = [];
  public simulatedError: Error | null = null;
  public failCount = 0;
  private currentAttempts = 0;

  async sendEmail(input: EmailInput): Promise<{ messageId: string }> {
    this.currentAttempts++;

    if (this.failCount > 0 && this.currentAttempts <= this.failCount) {
      throw (
        this.simulatedError ??
        new Error(
          `Simulated transient email failure (attempt ${this.currentAttempts})`,
        )
      );
    }

    if (this.simulatedError && this.failCount === 0) {
      throw this.simulatedError;
    }

    this.sentEmails.push({ ...input });
    const messageId = `mem-email-${this.sentEmails.length}-${Date.now()}`;
    return { messageId };
  }

  setSimulatedError(error: Error | null, failCount = 0): void {
    this.simulatedError = error;
    this.failCount = failCount;
    this.currentAttempts = 0;
  }

  clear(): void {
    this.sentEmails = [];
    this.simulatedError = null;
    this.failCount = 0;
    this.currentAttempts = 0;
  }
}
