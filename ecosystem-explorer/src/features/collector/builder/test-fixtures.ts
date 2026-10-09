/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { IndexComponent } from "@/types/collector";

/*
 * Release components modeled on real v0.161.0 data: a renamed config key with its
 * deprecated alias (otlpexporter), a module on a v1.x version (k8sattributesprocessor),
 * a nested module path (filestorage), and one without Go module data yet.
 */

const CORE = "go.opentelemetry.io/collector";
const CONTRIB = "github.com/open-telemetry/opentelemetry-collector-contrib";

export const OTLP_RECEIVER: IndexComponent = {
  id: "core-otlpreceiver",
  name: "otlpreceiver",
  distribution: "core",
  type: "receiver",
  display_name: "OTLP Receiver",
  stability: "stable",
  distributions: ["contrib", "core", "k8s", "otlp"],
  config_type: "otlp",
  go_module: `${CORE}/receiver/otlpreceiver`,
  go_module_version: "v0.161.0",
};

export const OTLP_EXPORTER: IndexComponent = {
  id: "core-otlpexporter",
  name: "otlpexporter",
  distribution: "core",
  type: "exporter",
  display_name: "OTLP gRPC Exporter",
  stability: "stable",
  distributions: ["contrib", "core", "k8s", "otlp"],
  config_type: "otlp_grpc",
  deprecated_config_type: "otlp",
  go_module: `${CORE}/exporter/otlpexporter`,
  go_module_version: "v0.161.0",
};

export const BATCH_PROCESSOR: IndexComponent = {
  id: "core-batchprocessor",
  name: "batchprocessor",
  distribution: "core",
  type: "processor",
  display_name: "Batch Processor",
  stability: "beta",
  distributions: ["contrib", "core", "k8s"],
  config_type: "batch",
  go_module: `${CORE}/processor/batchprocessor`,
  go_module_version: "v0.161.0",
};

export const K8S_ATTRIBUTES_PROCESSOR: IndexComponent = {
  id: "contrib-k8sattributesprocessor",
  name: "k8sattributesprocessor",
  distribution: "contrib",
  type: "processor",
  display_name: "Kubernetes Attributes Processor",
  stability: "stable",
  distributions: ["contrib", "k8s"],
  config_type: "k8s_attributes",
  deprecated_config_type: "k8sattributes",
  go_module: `${CONTRIB}/processor/k8sattributesprocessor`,
  go_module_version: "v1.0.0",
};

export const FILE_STORAGE: IndexComponent = {
  id: "contrib-filestorage",
  name: "filestorage",
  distribution: "contrib",
  type: "extension",
  display_name: "File Storage Extension",
  stability: "beta",
  distributions: ["contrib", "k8s"],
  config_type: "file_storage",
  go_module: `${CONTRIB}/extension/storage/filestorage`,
  go_module_version: "v0.161.0",
};

export const FORWARD_CONNECTOR: IndexComponent = {
  id: "core-forwardconnector",
  name: "forwardconnector",
  distribution: "core",
  type: "connector",
  display_name: "Forward Connector",
  stability: "beta",
  distributions: ["contrib", "core"],
  config_type: "forward",
  go_module: `${CORE}/connector/forwardconnector`,
  go_module_version: "v0.161.0",
};

/** A component from data that predates Go module fields. */
export const NO_MODULE_RECEIVER: IndexComponent = {
  id: "contrib-filelogreceiver",
  name: "filelogreceiver",
  distribution: "contrib",
  type: "receiver",
  display_name: "Filelog Receiver",
  stability: "beta",
  distributions: ["contrib", "k8s"],
  config_type: "filelog",
};

export const RELEASE_COMPONENTS: IndexComponent[] = [
  OTLP_RECEIVER,
  OTLP_EXPORTER,
  BATCH_PROCESSOR,
  K8S_ATTRIBUTES_PROCESSOR,
  FILE_STORAGE,
  FORWARD_CONNECTOR,
  NO_MODULE_RECEIVER,
];
