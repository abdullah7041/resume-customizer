# State Machine Diagrams

## Resume Customizer - Main Flow

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> UPLOADING: file selected
    
    UPLOADING --> PARSING: upload success
    UPLOADING --> IDLE: upload failed
    
    PARSING --> PARSED_OK: parse success<br/>+ show preview
    PARSING --> PARSE_ERROR: parse failed<br/>+ show error
    
    PARSE_ERROR --> IDLE: retry / new file
    
    PARSED_OK --> OPTIMIZING: optimize clicked
    PARSED_OK --> TEMPLATE_SELECTION: skip optimization
    
    OPTIMIZING --> OPTIMIZED: AI response OK<br/>+ show score
    OPTIMIZING --> OPTIMIZE_ERROR: AI failed<br/>+ show warning
    
    OPTIMIZE_ERROR --> PARSED_OK: retry
    OPTIMIZE_ERROR --> TEMPLATE_SELECTION: skip
    
    OPTIMIZED --> TEMPLATE_SELECTION: continue
    OPTIMIZED --> PARSED_OK: revert changes
    
    TEMPLATE_SELECTION --> EDITING: edit clicked
    TEMPLATE_SELECTION --> DOWNLOADING: download clicked
    
    EDITING --> TEMPLATE_SELECTION: save changes
    
    DOWNLOADING --> DOWNLOAD_COMPLETE: PDF generated
    DOWNLOADING --> DOWNLOAD_ERROR: generation failed
    
    DOWNLOAD_COMPLETE --> TEMPLATE_SELECTION: done
    DOWNLOAD_ERROR --> TEMPLATE_SELECTION: retry
    
    TEMPLATE_SELECTION --> IDLE: new resume / clear
```

---

## Optimization State Machine

```mermaid
stateDiagram-v2
    [*] --> IDLE
    
    IDLE --> CHECKING: job description entered
    
    CHECKING --> ANALYZING: resume data available<br/>+ NO cached analysis
    CHECKING --> CACHED_RESULT: resume data available<br/>+ HAS cached analysis
    
    CACHED_RESULT --> SHOWING_SCORE: show cached score
    
    ANALYZING --> SHOWING_SCORE: AI analysis complete<br/>+ show breakdown
    ANALYZING --> INSUFFICIENT: missing data<br/>+ show warning
    
    INSUFFICIENT --> IDLE: add more data
    
    SHOWING_SCORE --> APPLYING: apply optimizations
    SHOWING_SCORE --> IDLE: clear / new JD
    
    APPLYING --> APPLIED: changes applied<br/>+ update preview
    
    APPLIED --> SHOWING_SCORE: revert changes
    APPLIED --> IDLE: JD changes / resume changes

    note right of CHECKING
        periodic re-check (10s)
        for stale data
    end note
```

---

## Cover Letter Generation Flow

```mermaid
stateDiagram-v2
    [*] --> IDLE
    
    IDLE --> INPUT_COLLECTED: company + hiring manager entered
    
    INPUT_COLLECTED --> GENERATING: generate clicked<br/>+ resume available
    INPUT_COLLECTED --> BLOCKED: resume missing<br/>+ show warning
    
    BLOCKED --> IDLE: upload resume first
    
    GENERATING --> GENERATED: AI success<br/>+ show preview
    GENERATING --> GENERATION_ERROR: AI failed
    
    GENERATION_ERROR --> INPUT_COLLECTED: retry
    
    GENERATED --> DOWNLOADING_CL: download clicked
    GENERATED --> INPUT_COLLECTED: regenerate
    
    DOWNLOADING_CL --> COMPLETE: PDF ready
    DOWNLOADING_CL --> DOWNLOAD_ERROR: failed
    
    DOWNLOAD_ERROR --> GENERATED: retry
    COMPLETE --> IDLE: new letter
```

---

## PDF Download State Machine

```mermaid
stateDiagram-v2
    [*] --> READY
    
    READY --> PREPARING: download clicked
    
    PREPARING --> GENERATING_PDF: template rendered<br/>+ show loading overlay
    
    GENERATING_PDF --> COMPLETE: PDF blob received<br/>+ trigger download
    GENERATING_PDF --> ERROR: generation failed<br/>+ show error toast
    
    ERROR --> READY: dismiss / retry
    
    COMPLETE --> READY: reset state
    
    note right of GENERATING_PDF
        LoadingMessages component
        shows rotating tips
    end note
```

---

## User Session States

```mermaid
stateDiagram-v2
    [*] --> ANONYMOUS
    
    ANONYMOUS --> AUTHENTICATED: login success
    ANONYMOUS --> TRIAL_MODE: continue as guest<br/>+ limited features
    
    TRIAL_MODE --> AUTHENTICATED: sign up
    TRIAL_MODE --> LIMIT_REACHED: free limit exceeded
    
    LIMIT_REACHED --> AUTHENTICATED: upgrade / sign up
    
    AUTHENTICATED --> ACTIVE: subscription valid
    AUTHENTICATED --> EXPIRED: subscription ended
    
    EXPIRED --> ACTIVE: renew subscription
    EXPIRED --> TRIAL_MODE: downgrade
    
    ACTIVE --> ANONYMOUS: logout
```

---

## State Legend

| State Type | Meaning |
|------------|---------|
| `IDLE` | Waiting for user input |
| `*_OK` / `COMPLETE` | Success state |
| `*_ERROR` / `INSUFFICIENT` | Error/warning state |
| `*ING` (e.g., PARSING) | Processing/loading state |
| `BLOCKED` | Cannot proceed |
