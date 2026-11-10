// Configure local-only symbol analysis before automatic analysis.
//@category ReverseEngineering
import java.io.File;
import java.util.Map;
import ghidra.app.plugin.core.analysis.PdbUniversalAnalyzer;
import ghidra.app.script.GhidraScript;

public class REConfigure extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        Map<String, String> options = getCurrentAnalysisOptionsAndValues(currentProgram);
        for (String name : options.keySet()) {
            if (name.equals("PDB") || name.equals("PDB Universal")) {
                setAnalysisOption(currentProgram, name, "false");
            }
        }
        if (args.length == 1 && !args[0].equals("none")) {
            PdbUniversalAnalyzer.setPdbFileOption(currentProgram, new File(args[0]));
            PdbUniversalAnalyzer.setAllowUntrustedOption(currentProgram, true);
            setAnalysisOption(currentProgram, "PDB Universal", "true");
        }
        println("RE: local-only PDB policy configured");
    }
}
