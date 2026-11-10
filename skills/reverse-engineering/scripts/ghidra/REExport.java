// Export function bodies, native instructions, direct references and strings.
//@category ReverseEngineering
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonElement;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileOptions;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.util.headless.HeadlessScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.Symbol;

public class REExport extends HeadlessScript {
    private int total = 0, completed = 0, failed = 0, skipped = 0;

    private String rva(Address address) {
        if (!address.getAddressSpace().equals(currentProgram.getImageBase().getAddressSpace())) return "";
        return "0x" + Long.toUnsignedString(address.subtract(currentProgram.getImageBase()), 16);
    }

    private void exportFunction(Function function, DecompInterface decompiler, int timeout,
                                Set<String> selected, BufferedWriter functions, BufferedWriter references) throws Exception {
        monitor.checkCancelled();
        JsonObject record = new JsonObject();
        Address entry = function.getEntryPoint();
        record.addProperty("entry", entry.toString());
        record.addProperty("rva", rva(entry));
        record.addProperty("name", function.getSymbol().getName(true));
        record.addProperty("signature", function.getPrototypeString(true, true));
        record.addProperty("symbol_source", function.getSymbol().getSource().toString());
        record.addProperty("signature_source", function.getSignatureSource().toString());
        record.addProperty("external", function.isExternal());
        record.addProperty("thunk", function.isThunk());
        record.addProperty("body_bytes", function.getBody().getNumAddresses());
        StringBuilder assembly = new StringBuilder();
        InstructionIterator instructions = currentProgram.getListing().getInstructions(function.getBody(), true);
        while (instructions.hasNext()) {
            monitor.checkCancelled();
            Instruction instruction = instructions.next();
            assembly.append(instruction.getAddress()).append("  ").append(instruction).append('\n');
            for (Reference reference : instruction.getReferencesFrom()) {
                Address destination = reference.getToAddress();
                Function target = currentProgram.getFunctionManager().getFunctionAt(destination);
                if (target == null) target = currentProgram.getFunctionManager().getFunctionContaining(destination);
                Symbol symbol = currentProgram.getSymbolTable().getPrimarySymbol(destination);
                JsonObject edge = new JsonObject();
                edge.addProperty("caller", entry.toString());
                edge.addProperty("site", instruction.getAddress().toString());
                edge.addProperty("target", destination.toString());
                edge.addProperty("callee", target == null ? "" : target.getEntryPoint().toString());
                edge.addProperty("target_name", symbol == null ? "" : symbol.getName(true));
                edge.addProperty("kind", reference.getReferenceType().toString());
                edge.addProperty("is_call", reference.getReferenceType().isCall());
                references.write(edge.toString()); references.newLine();
            }
        }
        record.addProperty("assembly", assembly.toString());
        boolean chosen = selected.isEmpty() || selected.contains(function.getName()) ||
            selected.contains(function.getSymbol().getName(true)) || selected.contains(entry.toString()) || selected.contains(rva(entry));
        String status = "not_selected", error = "", code = "";
        if (function.isExternal()) status = "external";
        else {
            total++;
            if (chosen) {
                DecompileResults result = decompiler.decompileFunction(function, timeout, monitor);
                error = result.getErrorMessage() == null ? "" : result.getErrorMessage();
                if (result.decompileCompleted() && result.getDecompiledFunction() != null) {
                    status = "decompiled"; code = result.getDecompiledFunction().getC(); completed++;
                } else { status = "failed"; failed++; }
            } else skipped++;
        }
        record.addProperty("status", status); record.addProperty("error", error); record.addProperty("code", code);
        functions.write(record.toString()); functions.newLine();
    }

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length != 3) throw new IllegalArgumentException("REExport.java OUTPUT FUNCTION_TIMEOUT TARGETS_JSON");
        Path output = Path.of(args[0]);
        int timeout = Integer.parseInt(args[1]);
        Set<String> selected = new HashSet<>();
        for (JsonElement value : JsonParser.parseString(Files.readString(Path.of(args[2]))).getAsJsonArray()) {
            selected.add(value.getAsString());
        }
        DecompInterface decompiler = new DecompInterface();
        DecompileOptions options = new DecompileOptions(); options.grabFromProgram(currentProgram);
        decompiler.setOptions(options);
        if (!decompiler.openProgram(currentProgram)) throw new IllegalStateException(decompiler.getLastMessage());
        try (BufferedWriter functions = Files.newBufferedWriter(output.resolve("functions.jsonl"), StandardCharsets.UTF_8);
             BufferedWriter references = Files.newBufferedWriter(output.resolve("references.jsonl"), StandardCharsets.UTF_8)) {
            FunctionIterator iterator = currentProgram.getFunctionManager().getFunctions(true);
            while (iterator.hasNext()) exportFunction(iterator.next(), decompiler, timeout, selected, functions, references);
            iterator = currentProgram.getFunctionManager().getExternalFunctions();
            while (iterator.hasNext()) exportFunction(iterator.next(), decompiler, timeout, selected, functions, references);
        } finally { decompiler.dispose(); }
        try (BufferedWriter strings = Files.newBufferedWriter(output.resolve("strings.jsonl"), StandardCharsets.UTF_8)) {
            DataIterator iterator = currentProgram.getListing().getDefinedData(true);
            while (iterator.hasNext()) {
                monitor.checkCancelled(); Data data = iterator.next(); Object value = data.getValue();
                if (!(value instanceof String)) continue;
                JsonObject row = new JsonObject(); row.addProperty("address", data.getAddress().toString());
                row.addProperty("value", (String)value); strings.write(row.toString()); strings.newLine();
            }
        }
        JsonObject summary = new JsonObject();
        summary.addProperty("program", currentProgram.getName());
        summary.addProperty("language", currentProgram.getLanguageID().toString());
        summary.addProperty("compiler", currentProgram.getCompilerSpec().getCompilerSpecID().toString());
        summary.addProperty("image_base", currentProgram.getImageBase().toString());
        summary.addProperty("analysis_timed_out", analysisTimeoutOccurred());
        summary.addProperty("internal_functions", total); summary.addProperty("decompiled", completed);
        summary.addProperty("failed", failed); summary.addProperty("not_selected", skipped);
        summary.addProperty("export_completed", true);
        Files.writeString(output.resolve("summary.json"), summary.toString(), StandardCharsets.UTF_8);
        println("RE export: " + summary);
    }
}
