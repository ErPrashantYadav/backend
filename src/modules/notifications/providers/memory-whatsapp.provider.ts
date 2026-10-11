import type { WhatsAppInput, WhatsAppProvider } from '../notification.types';

export class MemoryWhatsAppProvider implements WhatsAppProvider {
  public sentMessages: WhatsAppInput[] = [];
  public simulatedError: Error | null = null;
  public failCount = 0;
  private currentAttempts = 0;

  async sendWhatsApp(input: WhatsAppInput): Promise<{ messageId: string }> {
    this.currentAttempts++;

    if (this.failCount > 0 && this.currentAttempts <= this.failCount) {
      throw (
        this.simulatedError ??
        new Error(
          `Simulated transient WhatsApp failure (attempt ${this.currentAttempts})`,
        )
      );
    }

    if (this.simulatedError && this.failCount === 0) {
      throw this.simulatedError;
    }

    this.sentMessages.push({ ...input });
    const messageId = `mem-wa-${this.sentMessages.length}-${Date.now()}`;
    return { messageId };
  }

  setSimulatedError(error: Error | null, failCount = 0): void {
    this.simulatedError = error;
    this.failCount = failCount;
    this.currentAttempts = 0;
  }

  clear(): void {
    this.sentMessages = [];
    this.simulatedError = null;
    this.failCount = 0;
    this.currentAttempts = 0;
  }
}
