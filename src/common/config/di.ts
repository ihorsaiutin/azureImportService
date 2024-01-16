import { appContainer } from "../inversify/container";
import { Config } from "./types";
import { interfaces } from "inversify";
import ServiceIdentifier = interfaces.ServiceIdentifier;
import { AppConfigurationClient } from "@azure/app-configuration";

// You should use string of Symbol identifiers in case there is no class
// specified, and you only have an Interface. Always specify ServiceIdentifier as a type,
// so that when you call "get"/"getAsync" you get correct type returned from container
export const CONFIG: ServiceIdentifier<Config> = Symbol.for("CONFIG");

// The app config can be fetched from external services like App Config, Key Vault or assembled from process.env
// if you are using app settings
appContainer
  .bind<Config>(CONFIG)
  .toDynamicValue(async () => {
    try {
      const connection_string = process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
      const client = new AppConfigurationClient(connection_string);

      const { value: db_key } = await client.getConfigurationSetting({
        key: "DB:COSMOS:KEY",
      });

      return {
        connectionString: connection_string,
      };
    } catch (e) {
      console.error(`GET app config error: ${e}`);
      return {};
    }
  })
  .inSingletonScope();
