SHELL := /usr/bin/env bash
.PHONY: test release-check release-compatibility-check test-install test-clean

DEVELOPER_CHARTS_DIR ?= ../developer-charts
PLATFORM_COMPONENTS_DIR ?= ../platform-components

test: test-install
	npm test --prefix test

release-check: test
	npm run --prefix test test:release
	node test/validate-release.js

release-compatibility-check:
	DEVELOPER_CHARTS_DIR="$(DEVELOPER_CHARTS_DIR)" \
	PLATFORM_COMPONENTS_DIR="$(PLATFORM_COMPONENTS_DIR)" \
		node test/validate-sibling-releases.js

test-install:
	npm ci --prefix test --loglevel=error

test-clean:
	rm -rf test/node_modules
