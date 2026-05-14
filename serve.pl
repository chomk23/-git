#!/usr/bin/perl
use strict;
use warnings;
use HTTP::Daemon;
use HTTP::Status;
use HTTP::Response;

my $port = 3000;
my $root = ".";

my %mime = (
  html => 'text/html; charset=utf-8',
  css  => 'text/css',
  js   => 'application/javascript',
  json => 'application/json',
  png  => 'image/png',
  jpg  => 'image/jpeg',
  svg  => 'image/svg+xml',
  ico  => 'image/x-icon',
  sql  => 'text/plain',
);

my $d = HTTP::Daemon->new(
  LocalAddr => '0.0.0.0',
  LocalPort => $port,
  ReuseAddr => 1,
) or die "Cannot start server on port $port: $!";

print "Server running at: http://localhost:$port/\n";
print "Root: $root\n";
$| = 1;

while (my $c = $d->accept) {
  while (my $r = $c->get_request) {
    my $path = $r->url->path;
    $path = '/login.html' if $path eq '/';
    $path =~ s|[.][.]||g;
    my $file = $root . $path;

    if (-f $file) {
      my ($ext) = $file =~ /\.(\w+)$/;
      my $type = $mime{lc($ext // '')} // 'application/octet-stream';
      open my $fh, '<:raw', $file or do { $c->send_error(RC_INTERNAL_SERVER_ERROR); next; };
      local $/; my $body = <$fh>; close $fh;
      my $res = HTTP::Response->new(RC_OK);
      $res->header('Content-Type' => $type);
      $res->header('Cache-Control' => 'no-cache');
      $res->content($body);
      $c->send_response($res);
    } else {
      $c->send_error(RC_NOT_FOUND, "File not found: $path");
    }
  }
  $c->close;
  undef $c;
}
