import { Context } from "@azure/functions";
import { injectable } from "inversify";
import { v4 as uuidv4 } from "uuid";

import { makeHandler } from "../common/inversify/make-handler";
import { BaseHandler } from "../common/handlers/base.handler";
import { Logger } from "../common/logger/logger";
import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";

require("dotenv").config();

const UPLOAD_CONTAINER_NAME = "uploaded";

@injectable()
export class HttpGetProductFilesHandler extends BaseHandler {
  constructor(private readonly logger: Logger) {
    super();
    this.logger.setClassContext(HttpGetProductFilesHandler.name);
  }

  async executeFunction(context: Context): Promise<void> {
    try {
      this.logger.info("Processing HttpGetProductFilesHandler request!");
      const {
        query: { name },
      } = context.bindingData;

      const blobName = name ?? `${uuidv4()}.csv`;

      const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AzureWebJobsStorage
      );
      const containerClient = blobServiceClient.getContainerClient(
        UPLOAD_CONTAINER_NAME
      );
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const blobSASUrl = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse("racw"),
        startsOn: new Date(),
        expiresOn: new Date(new Date().valueOf() + 86400),
      });

      context.res = {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        body: { blobSASUrl },
      };
    } catch (e) {
      this.logger.error(e);
      context.res = {
        status: 500,
      };
    }
  }
}

export const handler = makeHandler(HttpGetProductFilesHandler);
