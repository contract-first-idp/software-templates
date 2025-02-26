package ${{ values.java_package }};

import org.apache.camel.CamelContext;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ApiRoute extends RouteBuilder {

    public ApiRoute(@Autowired CamelContext context) {
        super(context);
    }

    @Override
    public void configure() throws Exception {

        restConfiguration()
                .bindingMode(RestBindingMode.json)
                .bindingPackageScan("${{ values.java_package }}")
                .apiContextPath("/api-docs");

        {% if values.implements_api %}
        rest().openApi().specification("${{ values.api_name }}-api.json").missingOperation("ignore");
        {% endif %}

        {% if values.consumes_apis %}
        from("direct:sampleOperationId")
                .removeHeaders("*")
                .to("rest-openapi:${{ values.consumed_api_name }}-api.json#${{ values.consumed_api_operation }}?host={{openapi.client.${{ values.consumed_api_name }}.host}}");
        {% endif %}

    }
}
