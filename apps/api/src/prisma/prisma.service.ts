import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { writeOperationalLog } from "../common/operational-log.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" }
      ]
    });
  }

  async onModuleInit() {
    if (process.env.DATABASE_URL) {
      await this.$connect();
      (this as PrismaClient).$on("warn" as never, (event: { message: string; target: string }) => {
        writeOperationalLog("warn", {
          type: "prisma_warn",
          message: event.message,
          target: event.target
        });
      });
      (this as PrismaClient).$on("error" as never, (event: { message: string; target: string }) => {
        writeOperationalLog("error", {
          type: "prisma_error",
          message: event.message,
          target: event.target
        });
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    (this as PrismaClient).$on("beforeExit" as never, async () => {
      await app.close();
    });
  }
}
