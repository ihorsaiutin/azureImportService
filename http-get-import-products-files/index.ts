import { AzureFunction } from "@azure/functions";

import { makeHandler } from "../src/common/inversify/make-handler";
import { HttpGetProductFilesHandler } from "../src/handlers/http-get-import-product-files.handler";

const httpTrigger: AzureFunction = makeHandler(HttpGetProductFilesHandler);
export default httpTrigger;
