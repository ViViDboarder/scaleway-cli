package main

import (
	"fmt"
	"os"
	"os/exec"

	log "github.com/Sirupsen/logrus"
)

var cmdAttach = &Command{
	Exec:        runAttach,
	UsageLine:   "attach [OPTIONS] SERVER",
	Description: "Attach to a server serial console",
	Help:        "Attach to a running server serial console.",
}

const termjsBin string = "termjs-cli"

func runAttach(cmd *Command, args []string) {
	if len(args) < 1 {
		log.Fatalf("usage: scw %s", cmd.UsageLine)
	}

	serverId := cmd.GetServer(args[0])

	termjsUrl := fmt.Sprintf("https://tty.cloud.online.net?server_id=%s&type=serial&auth_token=%s", serverId, cmd.API.Token)

	log.Debugf("Executing: %s %s", termjsBin, termjsUrl)
	// FIXME: check if termjs-cli is installed
	spawn := exec.Command(termjsBin, termjsUrl)
	spawn.Stdout = os.Stdout
	spawn.Stdin = os.Stdin
	spawn.Stderr = os.Stderr
	err := spawn.Run()
	if err != nil {
		log.Warnf("%v", err)
		fmt.Sprintf(os.Stderr, `
You need to install '%s' from https://github.com/moul/term.js-cli

    npm install -g term.js-cli

However, you can access your serial using a web browser:

    %s

`, termjsBin, termjsUrl)
		os.Exit(1)
	}
}
