provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "import_service_rg" {
  location = "northeurope"
  name     = "rg-import-service-sand-ne-574"
}

resource "azurerm_storage_account" "import_service_fa" {
  name     = "stgsangimportfane574"
  location = "northeurope"

  account_replication_type = "LRS"
  account_tier             = "Standard"
  account_kind             = "StorageV2"

  resource_group_name = azurerm_resource_group.import_service_rg.name
}

resource "azurerm_storage_share" "import_service_fa" {
  name  = "fa-import-service-share"
  quota = 2

  storage_account_name = azurerm_storage_account.import_service_fa.name
}

resource "azurerm_service_plan" "import_service_plan" {
  name     = "asp-import-service-sand-ne-574"
  location = "northeurope"

  os_type  = "Windows"
  sku_name = "Y1"

  resource_group_name = azurerm_resource_group.import_service_rg.name
}

resource "azurerm_application_insights" "import_service_fa" {
  name             = "appins-fa-import-service-sand-ne-574"
  application_type = "web"
  location         = "northeurope"


  resource_group_name = azurerm_resource_group.import_service_rg.name
}


resource "azurerm_windows_function_app" "import_service" {
  name     = "fa-import-service-ne-574"
  location = "northeurope"

  service_plan_id     = azurerm_service_plan.import_service_plan.id
  resource_group_name = azurerm_resource_group.import_service_rg.name

  storage_account_name       = azurerm_storage_account.import_service_fa.name
  storage_account_access_key = azurerm_storage_account.import_service_fa.primary_access_key

  functions_extension_version = "~4"
  builtin_logging_enabled     = false

  site_config {
    always_on = false

    application_insights_key               = azurerm_application_insights.import_service_fa.instrumentation_key
    application_insights_connection_string = azurerm_application_insights.import_service_fa.connection_string

    # For production systems set this to false
    use_32_bit_worker = false

    # Enable function invocations from Azure Portal.
    cors {
      allowed_origins = ["https://portal.azure.com"]
    }

    application_stack {
      node_version = "~16"
    }
  }

  app_settings = {
    WEBSITE_CONTENTAZUREFILECONNECTIONSTRING = azurerm_storage_account.import_service_fa.primary_connection_string
    WEBSITE_CONTENTSHARE                     = azurerm_storage_share.import_service_fa.name
  }

  # The app settings changes cause downtime on the Function App. e.g. with Azure Function App Slots
  # Therefore it is better to ignore those changes and manage app settings separately off the Terraform.
  lifecycle {
    ignore_changes = [
      app_settings,
      tags["hidden-link: /app-insights-instrumentation-key"],
      tags["hidden-link: /app-insights-resource-id"],
      tags["hidden-link: /app-insights-conn-string"]
    ]
  }
}

data "azurerm_function_app_host_keys" "import_keys" {
  name                = azurerm_windows_function_app.import_service.name
  resource_group_name = azurerm_resource_group.import_service_rg.name
}

resource "azurerm_storage_container" "sa_container_uploaded" {
  name                  = "uploaded"
  storage_account_name  = azurerm_storage_account.import_service_fa.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "sa_container_parsed" {
  name                  = "parsed"
  storage_account_name  = azurerm_storage_account.import_service_fa.name
  container_access_type = "private"
}

resource "azurerm_api_management_api" "import_api" {
  api_management_name = "apim-sand-ne-574"
  name                = "import-service-api"
  resource_group_name = "rg-api-management-sand-ne-574"
  revision            = "1"
  path                = "import"

  display_name = "Import Service API"

  protocols = ["https"]
}

resource "azurerm_api_management_backend" "import_fa" {
  name                = "import-service-backend"
  resource_group_name = "rg-api-management-sand-ne-574"
  api_management_name = "apim-sand-ne-574"
  protocol            = "http"
  url                 = "https://${azurerm_windows_function_app.import_service.name}.azurewebsites.net/api"
  description         = "Import API"

  credentials {
    certificate = []
    query       = {}

    header = {
      "x-functions-key" = data.azurerm_function_app_host_keys.import_keys.default_function_key
    }
  }
}

resource "azurerm_api_management_api_policy" "api_policy" {
  api_management_name = "apim-sand-ne-574"
  api_name            = azurerm_api_management_api.import_api.name
  resource_group_name = "rg-api-management-sand-ne-574"

  xml_content = <<XML
 <policies>
    <inbound>
        <set-backend-service backend-id="${azurerm_api_management_backend.import_fa.name}"/>
        <base/>
        <cors allow-credentials="false">
            <allowed-origins>
                <origin>*</origin>
            </allowed-origins>
            <allowed-methods>
                <method>GET</method>
            </allowed-methods>
            <allowed-headers>
                <header>*</header>
            </allowed-headers>
            <expose-headers>
                <header>*</header>
            </expose-headers>
        </cors>
    </inbound>
    <backend>
        <base/>
    </backend>
    <outbound>
        <base/>
    </outbound>
    <on-error>
        <base/>
    </on-error>
 </policies>
XML
}

resource "azurerm_api_management_api_operation" "get_import_product_files" {
  api_management_name = "apim-sand-ne-574"
  api_name            = azurerm_api_management_api.import_api.name
  display_name        = "Get Import Product Files"
  method              = "GET"
  operation_id        = "get-import-product-files"
  resource_group_name = "rg-api-management-sand-ne-574"
  url_template        = "/import"
}