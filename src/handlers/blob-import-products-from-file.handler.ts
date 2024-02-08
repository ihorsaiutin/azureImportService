import { Context } from "@azure/functions";
import { ServiceBusClient } from "@azure/service-bus";
import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";
import { injectable } from "inversify";

import { makeHandler } from "../common/inversify/make-handler";
import { BaseHandler } from "../common/handlers/base.handler";
import { Logger } from "../common/logger/logger";
import {
  PARSED_CONTAINER_NAME,
  SERVICE_BUS_ITEM_TYPE,
  SERVICE_BUS_TOPIC_NAME,
  UPLOAD_CONTAINER_NAME,
} from "../constants";

require("dotenv").config();

@injectable()
export class BlobImportProductsFromFile extends BaseHandler {
  constructor(private readonly logger: Logger) {
    super();
    this.logger.setClassContext(BlobImportProductsFromFile.name);
  }

  async executeFunction(context: Context, blob: Buffer): Promise<void> {
    this.logger.info("Processing BlobImportProductsFromFile request!");

    const blobString = blob.toString();
    const linesDelimiter = blobString.includes("\r\n") ? "\r\n" : "\n";

    const productsStrings = blobString.split(linesDelimiter);

    const products = productsStrings.map((productsString) => {
      const [title, description, price, count] = productsString.split(",");
      return {
        title: title.trim(),
        description: description.trim(),
        price: Number(price.trim()),
        count: Number(count.trim()),
      };
    });

    const serviceBusConnectionString = process.env.ServiceBusConnectionString;

    const serviceBusClient = new ServiceBusClient(serviceBusConnectionString);
    const sender = serviceBusClient.createSender(SERVICE_BUS_TOPIC_NAME);

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

    try {
      await sender.sendMessages({
        body: JSON.stringify(products),
        applicationProperties: {
          type: SERVICE_BUS_ITEM_TYPE.PRODUCTS,
        },
      });

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
        body: `${e.message}`,
      };
    } finally {
      await sender.close();
      await serviceBusClient.close();
    }
  }
}

export const handler = makeHandler(BlobImportProductsFromFile);
