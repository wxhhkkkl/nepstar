"""Fixed forwarding ports and recovery of a dropped development SSH connection."""

from io import BytesIO
from pathlib import Path
from unittest.mock import Mock

import pytest

from scripts.keep_report_tunnel import ssh_command, supervise


def configuration():
    return {
        "MONGODB_URL": "mongodb://reader:secret@mongo-a:3717,mongo-b:3717/reports",
        "DATABASE_URL": "mysql+aiomysql://reader:secret@mysql:3306/legacy",
        "CONFIG_DATABASE_URL": "mysql+aiomysql://reader:secret@mysql:3306/config",
        "NEPSTAR_DATABASE_URL": "mysql+aiomysql://reader:secret@mysql:3306/nepstar",
        "SERVER_USER": "dev", "SERVER_IP": "ssh.example",
    }, {"loopback_ports": [52549, 52550], "read_only_mysql_forward_ports": [52551]}


def test_reuses_fixed_loopback_ports_and_deduplicates_mysql_hosts():
    values, state = configuration()
    command = ssh_command(values, state, Path("/runtime"))
    forwards = [command[i + 1] for i, item in enumerate(command) if item == "-L"]
    assert forwards == ["127.0.0.1:52549:mongo-a:3717", "127.0.0.1:52550:mongo-b:3717",
                        "127.0.0.1:52551:mysql:3306"]
    assert "StrictHostKeyChecking=yes" in command
    assert "ExitOnForwardFailure=yes" in command
    assert "ServerAliveInterval=15" in command
    assert "secret" not in " ".join(command)


@pytest.mark.parametrize("ports", [[52549], [52549, 52549], [52549, 80]])
def test_invalid_forward_state_cannot_start(ports):
    values, state = configuration()
    state["loopback_ports"] = ports
    with pytest.raises(ValueError):
        ssh_command(values, state, Path("/runtime"))


def test_reconnects_exited_ssh_and_stops_the_replacement():
    first = Mock(pid=1)
    first.poll.return_value = 255
    second = Mock(pid=2)
    second.poll.return_value = None
    launch = Mock(side_effect=[first, second])
    stopped = Mock()
    stopped.is_set.side_effect = [False, False, False, True]
    stopped.wait.side_effect = [False, True]
    supervise(["ssh"], {}, stopped, BytesIO(), launch)
    assert launch.call_count == 2
    first.terminate.assert_not_called()
    second.terminate.assert_called_once()
    second.wait.assert_called_once_with(timeout=15)


def test_repeated_failures_back_off_without_tight_retry_loop():
    process = Mock(pid=1)
    process.poll.return_value = 255
    stopped = Mock()
    stopped.is_set.return_value = False
    stopped.wait.side_effect = [False, False, False, True]
    supervise(["ssh"], {}, stopped, BytesIO(), Mock(return_value=process))
    assert [call.args[0] for call in stopped.wait.call_args_list] == [1, 2, 4, 8]
