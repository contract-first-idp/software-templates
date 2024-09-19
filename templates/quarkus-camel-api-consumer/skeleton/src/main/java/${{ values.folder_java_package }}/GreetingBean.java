package ${{ values.java_package }};

import java.util.HashMap;

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

    public HashMap<String, String> greet(HashMap<String, String> body) {
        HashMap<String, String> greeting = new HashMap<String, String>();
        greeting.put("response", message + " " + body.get("name"));
        return greeting;
    }
}
