import { AzureFunction, Context } from "@azure/functions";

import { makeHandler } from "../src/common/inversify/make-handler";
import { BlobImportProductsFromFile } from "../src/handlers/blob-import-products-from-file.handler";

const blobTrigger: AzureFunction = makeHandler(BlobImportProductsFromFile);
export default blobTrigger;
