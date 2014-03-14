package main

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/garyburd/redigo/redis"
)

var conn redis.Conn

func classify(out io.Writer, data []byte) {
	// do the classification first
	resp, _ := http.Post("http://localhost:3350/convnet/classify?model=image-net", "image/unknown", bytes.NewReader(data))
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func face(out io.Writer, data []byte) {
	resp, _ := http.Post("http://localhost:3350/bbf/detect.objects?model=face&max_dimension=800", "image/unknown", bytes.NewReader(data))
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func car(out io.Writer, data []byte) {
	resp, _ := http.Post("http://localhost:3350/dpm/detect.objects?model=car&max_dimension=800", "image/unknown", bytes.NewReader(data))
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func pedestrian(out io.Writer, data []byte) {
	resp, _ := http.Post("http://localhost:3350/icf/detect.objects?model=pedestrian&max_dimension=800", "image/unknown", bytes.NewReader(data))
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func word(out io.Writer, data []byte) {
	resp, _ := http.Post("http://localhost:3350/swt/detect.words?max_dimension=1024", "image/unknown", bytes.NewReader(data))
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func root(response http.ResponseWriter, request *http.Request) {
	source, _, err := request.FormFile("source")
	if err != nil {
		return
	}
	data, _ := ioutil.ReadAll(source)
	sha := sha1.New()
	sha.Write(data)
	identifier := strings.Trim(base64.URLEncoding.EncodeToString(sha.Sum(nil)), "=")
	resp, _ := redis.Bytes(conn.Do("GET", identifier))
	if resp != nil && len(resp) > 0 {
		io.Copy(response, bytes.NewReader(resp))
	} else {
		buffer := new(bytes.Buffer);
		fmt.Fprintf(buffer, "{\"classify\":");
		classify(buffer, data);
		fmt.Fprintf(buffer, ",\"face\":");
		face(buffer, data);
		fmt.Fprintf(buffer, ",\"car\":");
		car(buffer, data);
		fmt.Fprintf(buffer, ",\"pedestrian\":");
		pedestrian(buffer, data);
		fmt.Fprintf(buffer, ",\"word\":");
		word(buffer, data);
		fmt.Fprintf(buffer, "}");
		json := buffer.String()
		io.Copy(response, buffer);
		conn.Do("SET", identifier, json)
	}
}

func main() {
	conn, _ = redis.Dial("tcp", "127.0.0.1:6379")
	http.HandleFunc("/api/ccv", root)
	http.Handle("/", http.FileServer(http.Dir("./site/")))
	http.ListenAndServe(":8080", nil)
}
