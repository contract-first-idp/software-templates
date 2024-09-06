package ${{ values.java_package_name }};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.FullyQualifiedAnnotationBeanNameGenerator;

@SpringBootApplication(
    nameGenerator = FullyQualifiedAnnotationBeanNameGenerator.class
)
@ComponentScan(
    basePackages = {"${{ values.java_package_name }}"},
    nameGenerator = FullyQualifiedAnnotationBeanNameGenerator.class
)
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

}