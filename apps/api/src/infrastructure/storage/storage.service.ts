import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("S3_ENDPOINT") ?? "http://localhost:9000";
    const region = this.configService.get<string>("S3_REGION") ?? "ru-central-1";
    const accessKeyId = this.configService.get<string>("S3_ACCESS_KEY") ?? "minio";
    const secretAccessKey = this.configService.get<string>("S3_SECRET_KEY") ?? "minio123";

    this.bucket = this.configService.get<string>("S3_BUCKET_UPLOADS") ?? "sporza-uploads";
    this.endpoint = endpoint;
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  async putObject(key: string, body: Buffer, contentType?: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObjectBuffer(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const chunks: Buffer[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array> | undefined;

    if (!stream) {
      return Buffer.alloc(0);
    }

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  getPublicObjectUrl(key: string) {
    const publicBaseUrl =
      this.configService.get<string>("S3_PUBLIC_BASE_URL") ?? `${this.endpoint.replace(/\/$/, "")}/${this.bucket}`;

    return `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  private async ensureBucket() {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );
    } catch {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucket,
        }),
      );
    }
  }
}
