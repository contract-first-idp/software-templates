package ${{ values.java_package }};

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
@Named("greeting")
@RegisterForReflection(fields = false)
public class GreetingBean {

    @ConfigProperty(name = "greeting.message")
    String message;

    public String greet() {
        return message;
    }
}