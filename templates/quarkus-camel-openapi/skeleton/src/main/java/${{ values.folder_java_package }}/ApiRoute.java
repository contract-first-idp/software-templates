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
        
        {% if values.implements_api %}
        rest().openApi().specification("${{ values.api_name }}-api.yaml").missingOperation("ignore");
        {% endif %}

        {% if values.consumes_apis %}
        from("direct:sampleOperationId")
                .removeHeaders("*")
                .to("rest-openapi:${{ values.consumed_api_name }}-api.yaml#${{ values.consumed_api_operation }}?host={{openapi.client.${{ values.consumed_api_name }}.host}}");
        {% endif %}
    }
}
