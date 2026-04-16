import { Comment, User } from "@/generated/prisma";

export type CommentWithAuthor = Comment & {
  author: Pick<User, "id" | "name" | "email">;
};

export interface CreateCommentInput {
  phaseId: string;
  content: string;
}
