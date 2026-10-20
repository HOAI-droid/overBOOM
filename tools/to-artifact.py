"""Wandelt den Einzeldatei-Build in eine Artifact-Seite um (ohne eigenes html/head/body-Gerüst)."""
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
title = re.search(r'<title>.*?</title>', src, re.S).group(0)
links = [l for l in re.findall(r'<link[^>]*>', src) if 'fonts.googleapis.com/css2' in l]
styles = re.findall(r'<style>.*?</style>', src, re.S)
scripts = re.findall(r'<script type="module"[^>]*>.*?</script>', src, re.S)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
body = re.sub(r'<script type="module"[^>]*>.*?</script>', '', body, flags=re.S).strip()
out = '\n'.join([title, *links, '<style>:root{color-scheme:dark;background:#0b0814}body{background:#0b0814;color:#f4ecff}</style>', *styles, body, *scripts])
open(sys.argv[2], 'w', encoding='utf-8').write(out)
print(len(out), 'Bytes')
