#!/bin/bash
# if we have a argument, we will use it as the gallery directory by setting the GALLERY_DIR variable
GALLERY_DIR=$1
export GALLERY_DIR
php -S 0.0.0.0:8050 
# This script will launch the PHP Gallery application with supplied arguments
