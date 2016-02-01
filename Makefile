SHELL := /bin/bash

HASH=$(shell git rev-parse master | cut -c 1-8)

all: copy
	@git commit -a -t <(echo "Release based on $(HASH)")

copy:
	rm -rf tasks package.json
	mkdir -p tasks
	cp -r build/grunt-sauce-load.js tasks/
	cp -r build/package.json .
