git add .
git commit -m "edit"
git push origin master
git add build && git commit -m "Initial dist subtree commit"
git subtree push --prefix build origin gh-pages
