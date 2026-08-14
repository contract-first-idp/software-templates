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

        {%- if values.provided_api %}
        rest().openApi().specification("${{ values.provided_api.contract_file }}").missingOperation("mock");
        {%- endif %}

        {%- for consumed_api in values.consumed_apis %}
        {%- for operation in consumed_api.operations %}
        from("direct:${{ consumed_api.alias }}.${{ operation.operation_id }}")
                .routeId("consume-${{ consumed_api.alias }}-${{ operation.operation_id }}")
                .removeHeaders("*")
                .to("rest-openapi:${{ consumed_api.contract_file }}#${{ operation.operation_id }}"
                        + "?host={{openapi.client.${{ consumed_api.alias }}.host}}");
        {%- endfor %}
        {%- endfor %}
    }
}
