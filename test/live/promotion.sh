#!/usr/bin/env bash
set -euo pipefail

if [[ "${PROMOTION_LIVE:-}" != "1" ]]; then
  echo "Refusing live promotion without PROMOTION_LIVE=1" >&2
  exit 2
fi

required=(SOURCE_NAMESPACE TARGET_NAMESPACE COMPONENT IMAGE_TAG)
missing=()
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || missing+=("$name")
done
if ((${#missing[@]})); then
  echo "Missing required variables: ${missing[*]}" >&2
  exit 2
fi
if [[ ! "$IMAGE_TAG" =~ ^v[0-9]+(\.[0-9]+){0,2}(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$ ]]; then
  echo "IMAGE_TAG must be an immutable human release such as v1.7.3" >&2
  exit 2
fi
for command in oc tkn; do
  command -v "$command" >/dev/null ||
    { echo "Required command is unavailable: $command" >&2; exit 2; }
done

source_secret="${SOURCE_PULL_SECRET_NAME:-default-quay-openshift}"
runtime_secret="${RUNTIME_PULL_SECRET_NAME:-default-quay-openshift}"
service_account="system:serviceaccount:${TARGET_NAMESPACE}:pipeline"

if [[ "$(oc auth can-i get "secret/${source_secret}" \
  -n "$SOURCE_NAMESPACE" --as "$service_account")" != "yes" ]]; then
  echo "Target pipeline cannot read the named source credential" >&2
  exit 1
fi
if [[ "$(oc auth can-i list secrets \
  -n "$SOURCE_NAMESPACE" --as "$service_account")" == "yes" ]]; then
  echo "Target pipeline can list source namespace Secrets" >&2
  exit 1
fi

source_uid_before="$(oc get secret "$source_secret" -n "$TARGET_NAMESPACE" \
  -o jsonpath='{.metadata.uid}')"
runtime_uid_before="$(oc get secret "$runtime_secret" -n "$TARGET_NAMESPACE" \
  -o jsonpath='{.metadata.uid}')"

run_name="$(tkn pipeline start promote-image \
  -n "$TARGET_NAMESPACE" \
  --serviceaccount pipeline \
  --param "component=${COMPONENT}" \
  --param "image-tag=${IMAGE_TAG}" \
  --use-param-defaults \
  --output name)"
tkn pipelinerun logs "$run_name" -n "$TARGET_NAMESPACE" --follow

source_digest="$(oc get "$run_name" -n "$TARGET_NAMESPACE" \
  -o jsonpath='{.status.results[?(@.name=="sourceDigest")].value}')"
destination_digest="$(oc get "$run_name" -n "$TARGET_NAMESPACE" \
  -o jsonpath='{.status.results[?(@.name=="destinationDigest")].value}')"
if [[ -z "$source_digest" || "$source_digest" != "$destination_digest" ]]; then
  echo "Promotion digest verification failed" >&2
  exit 1
fi

[[ "$(oc get secret "$source_secret" -n "$TARGET_NAMESPACE" \
  -o jsonpath='{.metadata.uid}')" == "$source_uid_before" ]]
[[ "$(oc get secret "$runtime_secret" -n "$TARGET_NAMESPACE" \
  -o jsonpath='{.metadata.uid}')" == "$runtime_uid_before" ]]

echo "Live promotion verified: ${COMPONENT}:${IMAGE_TAG} ${source_digest}"
