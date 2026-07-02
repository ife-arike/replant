#!/usr/bin/env python3
"""Serve the CD concepts directory for preview."""
import os, http.server, sys

port = int(os.environ.get('PORT', 7801))
directory = '/Users/ife/Documents/Claude/Projects/Replant'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)
    def log_message(self, fmt, *args):
        pass  # suppress logs

http.server.HTTPServer(('', port), Handler).serve_forever()
