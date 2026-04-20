import { Comment, User, TemporaryAttachment } from "@/generated/prisma";

export type CommentWithAuthor = Comment & {
  author: Pick<User, "id" | "name" | "email">;
  temp_attachments?: TemporaryAttachment[];
};

export interface CreateCommentInput {
  phaseId: string;
  content: string;
}
