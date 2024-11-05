package ${{ values.java_package }};

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;

@ApplicationScoped
public class ApiRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {

        restConfiguration().bindingMode(RestBindingMode.json)
                .bindingPackageScan("${{ values.java_package }}");

        rest().openApi().specification("${{ values.api_id }}-api.json").missingOperation("ignore");

        from("direct:sampleOperationId")
                .removeHeaders("*")
                .to("rest-openapi:${{ values.consumed_api_id }}-api.json#${{ values.consumed_api_operation }}?host={{openapi.client.${{ values.consumed_api_id }}.host}}");

    }
}
