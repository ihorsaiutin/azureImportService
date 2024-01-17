import { Context } from "@azure/functions";
import { injectable } from "inversify";

import { makeHandler } from "../common/inversify/make-handler";
import { BaseHandler } from "../common/handlers/base.handler";
import { Logger } from "../common/logger/logger";
import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";
import { PARSED_CONTAINER_NAME, UPLOAD_CONTAINER_NAME } from "../constants";

require("dotenv").config();

@injectable()
export class BlobImportProductsFromFile extends BaseHandler {
  constructor(private readonly logger: Logger) {
    super();
    this.logger.setClassContext(BlobImportProductsFromFile.name);
  }

  async executeFunction(context: Context, blob: Buffer): Promise<void> {
    try {
      this.logger.info("Processing BlobImportProductsFromFile request!");

      this.logger.info(
        "Blob trigger function processed blob \n Name:",
        context.bindingData.name,
        "\n Blob Size:",
        blob.length,
        "Bytes"
      );

      this.logger.info("---blob data", blob.toString());

      const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AzureWebJobsStorage
      );
      const sourceContainer = blobServiceClient.getContainerClient(
        UPLOAD_CONTAINER_NAME
      );
      const destinationContainer = blobServiceClient.getContainerClient(
        PARSED_CONTAINER_NAME
      );

      const sourceBlob = sourceContainer.getBlockBlobClient(
        context.bindingData.name
      );
      const destinationBlob = destinationContainer.getBlockBlobClient(
        sourceBlob.name
      );

      const response = await destinationBlob.beginCopyFromURL(sourceBlob.url);
      await response.pollUntilDone();
      await sourceBlob.delete();

      context.res = {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        body: {},
      };
    } catch (e) {
      this.logger.error(e);
      context.res = {
        status: 500,
      };
    }
  }
}

export const handler = makeHandler(BlobImportProductsFromFile);
