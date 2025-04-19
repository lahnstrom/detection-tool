list.of.packages <- c("DiagrammeR", "DiagrammeRsvg", "rsvg", "dplyr", "stringr")
new.packages <- list.of.packages[!(list.of.packages %in% installed.packages()[,"Package"])]
if(length(new.packages)) install.packages(new.packages)

library(dplyr)
library('DiagrammeR')
library(DiagrammeRsvg)
library(stringr)
library(rsvg)  

detection_tool_file <- './code/detection_tool.dot'
detection_tool_diagram <- readChar(detection_tool_file, file.info(detection_tool_file)$size)
detection_tool <- grViz(detection_tool_diagram)
print(detection_tool)
tmp <- DiagrammeRsvg::export_svg(detection_tool)
tmp <- charToRaw(tmp) 
rsvg::rsvg_pdf(tmp, "./out/figures/detection_tool.pdf")

detection_tool_file_swer <- './code/detection_tool_SWE.dot'
detection_tool_diagram_swe <- readChar(detection_tool_file_swer, file.info(detection_tool_file_swer)$size)
detection_tool <- grViz(detection_tool_diagram_swe)
tmp <- DiagrammeRsvg::export_svg(detection_tool)
tmp <- charToRaw(tmp) 
rsvg::rsvg_pdf(tmp, "./out/figures/detection_tool_swe.pdf")


# Exclusion flowchart, NB. please run processing_ctgov.R FIRST and keep variables in memory
observational_n <- study_type %>% filter(`Study Type` == "OBSERVATIONAL") %>% pull(n) 
interventional_n <- study_type %>% filter(`Study Type` == "INTERVENTIONAL") %>% pull(n) 
ineligible_date_n <- eligibility_year %>% filter(eligible_year==F) %>% pull(n)
missing_date_n <- eligibility_year %>% filter(is.na(eligible_year)) %>% pull(n)
eligible_date_n <- eligibility_year %>% filter(eligible_year) %>% pull(n)
eligible_missing_date_n <- missing_date_n + eligible_date_n
excluded_random_sample_n <- eligible_date_n - sample_size

# List of variable names
numbers_to_format <- c("total_n", "observational_n", "interventional_n", 
          "ineligible_date_n", "missing_date_n", "eligible_date_n", 
          "eligible_missing_date_n","excluded_random_sample_n", "sample_size")

# Apply formatting and reassign using quoting and unquoting. Yes, this is lazy.
for (var in numbers_to_format) {
  assign(var, format(eval(parse(text = var)), big.mark = ",", scientific = FALSE))
}

digraph_contents <- str_glue("
  graph [layout = dot, rankdir = TB, splines = ortho]
  node [shape = rectangle, style = filled, fillcolor = white, fontsize = 12, width = 4]

  Start [label = 'All completed or terminated trials on clinicaltrials.gov\non October 24, 2024\n(n = {total_n})'  ]
  
  Excluded_Design [label = 'Excluded due to non-interventional design\n(n = {observational_n})' fillcolor = \"#E8E8E8\"]
  Included_Design [label = 'Trials with interventional design\n(n = {interventional_n})']

  Excluded_Date [label = 'Excluded due to completion during,\nor after October 2022\n(n = {ineligible_date_n})' fillcolor = \"#E8E8E8\"]
  Included_Date [label = 'Trials completed before October 2022,\nor with missing completion date\n(n = {eligible_missing_date_n})']

  Excluded_Missing_Date [label = 'Excluded due to missing completion date\n(n = {missing_date_n})' fillcolor = \"#E8E8E8\"]
  Included_Missing_Date [label = 'Interventional trials with appropriate completion dates\n(n = {eligible_date_n})']

  Excluded_Sample [label = 'Excluded during random sampling\n(n = {excluded_random_sample_n})' fillcolor = \"#E8E8E8\"]
  Included_Sample [label = 'Final included random sample\n(n = {sample_size})']
")

# Have to be split due to conflicts with syntax and glue templating
digraph_contents_2 <- 
  "  
  { rank = same; Start; Excluded_Design }
  { rank = same; Included_Design; Excluded_Date }
  { rank = same; Included_Date; Excluded_Missing_Date }
  { rank = same; Included_Missing_Date; Excluded_Sample }
  { rank = same; Included_Sample }

  Start -> Excluded_Design
  Start -> Included_Design
  Included_Design -> Excluded_Date
  Included_Design -> Included_Date
  Included_Date -> Excluded_Missing_Date
  Included_Date -> Included_Missing_Date
  Included_Missing_Date -> Excluded_Sample
  Included_Missing_Date -> Included_Sample"

exclusion_chart <- grViz(paste0("digraph inclusion_exclusion {", digraph_contents, digraph_contents_2, "} "))
# Convoluted way of exporting as pdf 
tmp <- DiagrammeRsvg::export_svg(exclusion_chart)
tmp <- charToRaw(tmp) 
rsvg::rsvg_pdf(tmp, "./out/figures/exclusion.pdf") 

################# SWEDISH #####################

digraph_contents <- str_glue("
  graph [layout = dot, rankdir = TB, splines = ortho]
  node [shape = rectangle, style = filled, fillcolor = white, fontsize = 12, width = 4]

  Start [label = 'Alla avslutade prövningar på clinicaltrials.gov\n24:e oktober, 2024\n(n = {total_n})'  ]
  
  Excluded_Design [label = 'Exkluderade på grund av icke-interventionell design\n(n = {observational_n})' fillcolor = \"#E8E8E8\"]
  Included_Design [label = 'Prövningar med interventioner\n(n = {interventional_n})']

  Excluded_Date [label = 'Exkluderade på grund av avslutningsdatum\n efter oktober 2022\n(n = {ineligible_date_n})' fillcolor = \"#E8E8E8\"]
  Included_Date [label = 'Prövningar avslutade innan oktober 2022,\neller utan avslutningsdatum\n(n = {eligible_missing_date_n})']

  Excluded_Missing_Date [label = 'Exkluderade på grund av saknat avslutningsdatum\n(n = {missing_date_n})' fillcolor = \"#E8E8E8\"]
  Included_Missing_Date [label = 'Interventionella prövningar med giltigt avslutningsdatum\n(n = {eligible_date_n})']

  Excluded_Sample [label = 'Exkluderade under slumpmässigt urval\n(n = {excluded_random_sample_n})' fillcolor = \"#E8E8E8\"]
  Included_Sample [label = 'Slutgiltigt urval\n(n = {sample_size})']
")

# Have to be split due to conflicts with syntax and glue templating
digraph_contents_2 <- 
  "  
  { rank = same; Start; Excluded_Design }
  { rank = same; Included_Design; Excluded_Date }
  { rank = same; Included_Date; Excluded_Missing_Date }
  { rank = same; Included_Missing_Date; Excluded_Sample }
  { rank = same; Included_Sample }

  Start -> Excluded_Design
  Start -> Included_Design
  Included_Design -> Excluded_Date
  Included_Design -> Included_Date
  Included_Date -> Excluded_Missing_Date
  Included_Date -> Included_Missing_Date
  Included_Missing_Date -> Excluded_Sample
  Included_Missing_Date -> Included_Sample"

exclusion_chart <- grViz(paste0("digraph inclusion_exclusion {", digraph_contents, digraph_contents_2, "} "))
# Convoluted way of exporting as pdf 
tmp <- DiagrammeRsvg::export_svg(exclusion_chart)
tmp <- charToRaw(tmp) 
rsvg::rsvg_pdf(tmp, "./out/figures/exclusion_swe.pdf") 

