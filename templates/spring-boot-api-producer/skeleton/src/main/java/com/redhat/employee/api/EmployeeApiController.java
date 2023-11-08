package com.redhat.employee.api;

import com.redhat.employee.model.Employee;
import com.redhat.employee.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.context.request.NativeWebRequest;

import javax.validation.Valid;
import java.util.List;
import java.util.Optional;

@javax.annotation.Generated(value = "org.openapitools.codegen.languages.SpringCodegen", date = "2023-09-11T16:48:36.763-04:00[America/New_York]")

@Controller
@RequestMapping("${openapi.employeeOpenAPI30.base-path:/v1}")
public class EmployeeApiController implements EmployeeApi {

    @Autowired
    EmployeeRepository employeeRepository;

    private final NativeWebRequest request;

    @org.springframework.beans.factory.annotation.Autowired
    public EmployeeApiController(NativeWebRequest request) {
        this.request = request;
    }

    @Override
    public Optional<NativeWebRequest> getRequest() {
        return Optional.ofNullable(request);
    }

    @Override
    public ResponseEntity<String> addEmployee(@Valid @RequestBody Employee employee) {
        employeeRepository.save(employee);
        return ResponseEntity.ok("Employee with id "+employee.getId()+" is added");
    }

    @Override
    public ResponseEntity<List<Employee>> getEmployees() {
        return ResponseEntity.ok(employeeRepository.findAll());
    }
}
