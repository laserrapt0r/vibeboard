{{- define "vibeboard.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 50 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 50 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "vibeboard.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
app.kubernetes.io/part-of: vibeboard
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "vibeboard.selector" -}}
app.kubernetes.io/instance: {{ .root.Release.Name | quote }}
app.kubernetes.io/name: {{ .name | quote }}
{{- end -}}

{{/* image: repository, tag, digest; a digest wins */}}
{{- define "vibeboard.image" -}}
{{- if .digest -}}
{{- printf "%s@%s" .repository .digest -}}
{{- else -}}
{{- printf "%s:%s" .repository (toString .tag) -}}
{{- end -}}
{{- end -}}

{{- define "vibeboard.secretName" -}}
{{- .Values.auth.existingSecret | default (printf "%s-secrets" (include "vibeboard.fullname" .)) -}}
{{- end -}}

{{- define "vibeboard.pgHost" -}}
{{- if .Values.postgres.enabled -}}
{{- printf "%s-postgres" (include "vibeboard.fullname" .) -}}
{{- else -}}
{{- required "postgres.external.host is required when postgres.enabled is false" .Values.postgres.external.host -}}
{{- end -}}
{{- end -}}

{{- define "vibeboard.clamavHost" -}}
{{- if .Values.clamav.enabled -}}
{{- printf "%s-clamav" (include "vibeboard.fullname" .) -}}
{{- else -}}
{{- .Values.clamav.external.host -}}
{{- end -}}
{{- end -}}

{{/* Pods ohne Versions-Label: Sonst startet ein Chart-Update auch Dienste neu, die sich nicht geändert haben */}}
{{- define "vibeboard.podLabels" -}}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/part-of: vibeboard
{{- end -}}

{{/* Für alle Pods gleich: Registry-Zugang und Platzierung */}}
{{- define "vibeboard.scheduling" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.tolerations }}
tolerations:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- with .Values.affinity }}
affinity:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}
