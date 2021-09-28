python -m nuitka --mingw64 --standalone --lto no run.py \
--plugin-enable=torch --plugin-enable=pylint-warnings --plugin-enable=numpy --plugin-enable=qt-plugins --enable-plugin=anti-bloat \
--noinclude-pytest-mode=nofollow --noinclude-setuptools-mode=nofollow \
--nofollow-import-to=PyQt5.QtGui \
--nofollow-import-to=PyQt5.QtWidgets \
--nofollow-import-to=PyQt5.QtCore \
--nofollow-import-to=matplotlib \
--nofollow-import-to=scipy \
--nofollow-import-to=tkinter \
--follow-imports