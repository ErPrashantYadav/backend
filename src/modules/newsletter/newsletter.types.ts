export interface NewsletterSubscriberRecord {
  id: string;
  email: string;
  isActive: boolean;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscribeInput {
  email: string;
}

export interface UnsubscribeInput {
  email: string;
}

export interface NewsletterQueryOptions {
  search?: string;
  isActive?: boolean;
}

export interface NewsletterRepository {
  findByEmail(email: string): Promise<NewsletterSubscriberRecord | null>;
  findById(id: string): Promise<NewsletterSubscriberRecord | null>;
  create(email: string): Promise<NewsletterSubscriberRecord>;
  reactivate(email: string): Promise<NewsletterSubscriberRecord>;
  unsubscribe(email: string): Promise<NewsletterSubscriberRecord>;
  list(options?: NewsletterQueryOptions): Promise<NewsletterSubscriberRecord[]>;
  delete(id: string): Promise<boolean>;
}
