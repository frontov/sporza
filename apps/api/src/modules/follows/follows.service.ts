import { BadRequestException, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../infrastructure/database/database.service";

@Injectable()
export class FollowsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async follow(currentUserId: string, userId: string) {
    if (currentUserId === userId) {
      throw new BadRequestException("Cannot follow yourself");
    }

    await this.databaseService.query(
      `
        INSERT INTO follows (follower_id, followee_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [currentUserId, userId],
    );

    return {
      userId,
      following: true,
    };
  }

  async unfollow(currentUserId: string, userId: string) {
    await this.databaseService.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
      currentUserId,
      userId,
    ]);

    return {
      userId,
      following: false,
    };
  }

  async listFollowing(viewerId: string) {
    const result = await this.databaseService.query<{
      user_id: string;
      username: string;
      full_name: string;
      avatar_url: string | null;
    }>(
      `
        SELECT
          p.user_id,
          p.username,
          p.full_name,
          p.avatar_url
        FROM follows f
        JOIN profiles p ON p.user_id = f.followee_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
      `,
      [viewerId],
    );

    return {
      items: result.rows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
      })),
    };
  }

  async listFollowers(viewerId: string) {
    const result = await this.databaseService.query<{
      user_id: string;
      username: string;
      full_name: string;
      avatar_url: string | null;
    }>(
      `
        SELECT
          p.user_id,
          p.username,
          p.full_name,
          p.avatar_url
        FROM follows f
        JOIN profiles p ON p.user_id = f.follower_id
        WHERE f.followee_id = $1
        ORDER BY f.created_at DESC
      `,
      [viewerId],
    );

    return {
      items: result.rows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        fullName: row.full_name,
        avatarUrl: row.avatar_url,
      })),
    };
  }
}
