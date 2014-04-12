all:
	echo "hello"
	echo "yello"
	for i in $(shell seq 1 10); do echo "working..."; sleep 0.3; done
	exit 1
