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
	"launchpad.net/goamz/aws"
	"launchpad.net/goamz/s3"
)

var conn redis.Conn
var docomputersdream *s3.Bucket

func classify(out io.Writer, data []byte) {
	// do the classification first
	resp, err := http.Post("http://localhost:3350/convnet/classify?model=image-net", "image/unknown", bytes.NewReader(data))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func face(out io.Writer, data []byte) {
	resp, err := http.Post("http://localhost:3350/bbf/detect.objects?model=face&max_dimension=800", "image/unknown", bytes.NewReader(data))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func car(out io.Writer, data []byte) {
	resp, err := http.Post("http://localhost:3350/dpm/detect.objects?model=car&max_dimension=800", "image/unknown", bytes.NewReader(data))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func pedestrian(out io.Writer, data []byte) {
	resp, err := http.Post("http://localhost:3350/icf/detect.objects?model=pedestrian&max_dimension=800", "image/unknown", bytes.NewReader(data))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func word(out io.Writer, data []byte) {
	resp, err := http.Post("http://localhost:3350/swt/detect.words?max_dimension=1024", "image/unknown", bytes.NewReader(data))
	if err != nil {
		return
	}
	defer resp.Body.Close()
	io.Copy(out, resp.Body)
}

func latest(response http.ResponseWriter, request *http.Request) {
	resp, _ := redis.Bytes(conn.Do("GET", "LATEST"))
	if resp == nil {
		return
	}
	io.Copy(response, bytes.NewReader(resp))
}

func parse(q string, data []byte) *bytes.Buffer {
	buffer := new(bytes.Buffer)
	fmt.Fprintf(buffer, "{\"url\":\"http://static.docomputersdream.org/%s.jpg\",\"meta\":{\"classify\":", q)
	classify(buffer, data)
	fmt.Fprintf(buffer, ",\"face\":")
	face(buffer, data)
	fmt.Fprintf(buffer, ",\"car\":")
	car(buffer, data)
	fmt.Fprintf(buffer, ",\"pedestrian\":")
	pedestrian(buffer, data)
	fmt.Fprintf(buffer, ",\"word\":")
	word(buffer, data)
	fmt.Fprintf(buffer, "}}")
	return buffer
}

func api(response http.ResponseWriter, request *http.Request) {
	q := request.FormValue("q")
	if len(q) <= 0 {
		return
	}
	resp, _ := redis.Bytes(conn.Do("GET", q))
	var json string
	if resp != nil && len(resp) > 0 {
		io.Copy(response, bytes.NewReader(resp))
		json = string(resp)
	} else {
		resp, err := http.Get(fmt.Sprintf("http://static.docomputersdream.org/%s.jpg", q))
		if err != nil {
			return
		}
		defer resp.Body.Close()
		data, _ := ioutil.ReadAll(resp.Body)
		buffer := parse(q, data)
		json = buffer.String()
		io.Copy(response, buffer)
		conn.Do("SET", q, json)
	}
	conn.Do("SET", "LATEST", json)
}

func ccv(response http.ResponseWriter, request *http.Request) {
	source, _, err := request.FormFile("source")
	if err != nil {
		return
	}
	data, _ := ioutil.ReadAll(source)
	sha := sha1.New()
	sha.Write(data)
	identifier := strings.Trim(base64.URLEncoding.EncodeToString(sha.Sum(nil)), "=")
	resp, _ := redis.Bytes(conn.Do("GET", identifier))
	var json string
	if resp != nil && len(resp) > 0 {
		io.Copy(response, bytes.NewReader(resp))
		json = string(resp)
	} else {
		docomputersdream.Put(fmt.Sprintf("%s.jpg", identifier), data, "image/jpeg", s3.PublicRead)
		buffer := parse(identifier, data)
		json = buffer.String()
		io.Copy(response, buffer)
		conn.Do("SET", identifier, json)
	}
	conn.Do("SET", "LATEST", json)
}

func main() {
	var err error
	conn, err = redis.Dial("tcp", "127.0.0.1:6379")
	if (err != nil) {
		panic(err.Error())
	}
	auth, err := aws.EnvAuth()
	if (err != nil) {
		panic(err.Error())
	}
	sto := s3.New(auth, aws.USEast)
	docomputersdream = sto.Bucket("static.docomputersdream.org")
	http.HandleFunc("/api/latest", latest)
	http.HandleFunc("/api/ccv", ccv)
	http.HandleFunc("/api/", api)
	http.Handle("/", http.FileServer(http.Dir("./site/")))
	http.ListenAndServe(":8080", nil)
}
